import type { Metadata } from "next";
import Link from "next/link";
import { SessionBar } from "@/components/session-bar";
import { requireAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readDb } from "@/lib/db";
import {
  approveChange,
  gscStatus,
  installGscKey,
  rejectChange,
  revertChange,
  startRunInBackground,
  verifyPendingChanges,
} from "@/lib/site-optimizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cerebro activity | YPN USA admin",
  robots: { index: false, follow: false },
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" });
}

function done(message: string): never {
  revalidatePath("/admin/cerebro");
  redirect(`/admin/cerebro?msg=${encodeURIComponent(message)}`);
}

async function uploadKey(formData: FormData) {
  "use server";
  await requireAdminSession("/admin/cerebro");
  const file = formData.get("key");
  if (!(file instanceof File) || file.size === 0) done("Choose the JSON key file first.");
  const result = installGscKey(await (file as File).text());
  done(result.ok ? `Search Console key saved for ${result.serviceAccount}.` : result.error);
}

async function runNow() {
  "use server";
  await requireAdminSession("/admin/cerebro");
  done(
    startRunInBackground() === "started"
      ? "Run started. Reload this page in about 2 minutes to see the result under Last run."
      : "A run is already going. Reload this page in a minute or two.",
  );
}

async function checkNow() {
  "use server";
  await requireAdminSession("/admin/cerebro");
  const results = await verifyPendingChanges();
  done(results.length ? `Checked ${results.length} change(s).` : "Nothing waiting to be checked.");
}

async function decide(formData: FormData) {
  "use server";
  await requireAdminSession("/admin/cerebro");
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  if (action === "revert") done((await revertChange(id)) ? "Rolled back." : "That change isn't live.");
  if (action === "approve") done((await approveChange(id)) ? "Approved and live." : "That change isn't waiting.");
  if (action === "reject") done(rejectChange(id) ? "Rejected." : "That change isn't waiting.");
  done("Unknown action.");
}

/** What Cerebro did on its own: loan officers who asked to hear from YPN USA, starter kits, borrower callbacks. */
export default async function AdminCerebroPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdminSession("/admin/cerebro");
  const { msg } = await searchParams;
  const db = readDb();
  const gsc = gscStatus();
  const changes = [...db.siteOverrides].reverse().slice(0, 60);
  const prospects = [...db.officerProspects].reverse().slice(0, 100);
  const kits = [...db.starterKits].reverse().slice(0, 100);
  const leadNames = new Map(db.borrowerLeads.map((lead) => [lead.id, lead.answers.name ?? "Unnamed lead"]));
  const officerNames = new Map(db.loanOfficers.map((officer) => [officer.id, officer.name]));
  const actions = [...db.cerebroActions].reverse().filter((action) => action.kind === "callback_request").slice(0, 100);

  return (
    <main className="min-h-full bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/admin/revenue" className="font-semibold text-cyan-700 hover:text-teal-600">
            Revenue
          </Link>
          <SessionBar />
        </nav>
        <h1 className="text-2xl font-semibold">Cerebro activity</h1>
        {msg ? <p className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm">{msg.slice(0, 300)}</p> : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Site optimizer</h2>
          <p className="mt-1 text-sm text-slate-600">
            Weekly, Cerebro reads Search Console and rewrites the search title and description of up to 3 pages that get seen but
            not clicked. Pricing, legal pages and the homepage are never changed on their own. Every change is checked on the live
            page and rolled back automatically if it doesn&rsquo;t show.
          </p>
          <p className="mt-3 text-sm">
            Search Console: {gsc.connected ? <strong>connected as {gsc.serviceAccount}</strong> : <strong>not connected</strong>}
            {db.siteOptimizer.lastRunSummary ? (
              <> · Last run{db.siteOptimizer.lastRunAt ? ` ${when(db.siteOptimizer.lastRunAt)}` : ""}: {db.siteOptimizer.lastRunSummary}</>
            ) : null}
          </p>
          <form action={uploadKey} className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <label className="font-medium" htmlFor="key">Upload the Search Console JSON key file:</label>
            <input id="key" name="key" type="file" accept="application/json,.json" className="text-sm" />
            <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 font-semibold text-white">Upload key</button>
          </form>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <form action={runNow}><button type="submit" disabled={!gsc.connected} className="rounded-full bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-40">Run now</button></form>
            <form action={checkNow}><button type="submit" className="rounded-full border border-slate-300 px-4 py-2 font-semibold">Check live changes</button></form>
          </div>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {changes.map((change) => (
              <li key={change.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{change.path} · {change.field}</span>
                  <span className="text-slate-500">{change.status}{change.checkResult ? ` · ${change.checkResult}` : ""} · {when(change.appliedAt ?? change.createdAt)}</span>
                </div>
                <p className="mt-1"><span className="text-slate-500">Now:</span> {change.value}</p>
                {change.previousValue ? <p className="text-slate-500">Before: {change.previousValue}</p> : null}
                <p className="text-slate-500">{change.reason}{change.evidence ? ` (${change.evidence})` : ""}</p>
                <form action={decide} className="mt-2 flex gap-2">
                  <input type="hidden" name="id" value={change.id} />
                  {change.status === "live" ? <button name="action" value="revert" className="rounded-full border border-slate-300 px-3 py-1">Roll back</button> : null}
                  {change.status === "proposed" ? <><button name="action" value="approve" className="rounded-full bg-slate-900 px-3 py-1 text-white">Approve</button><button name="action" value="reject" className="rounded-full border border-slate-300 px-3 py-1">Reject</button></> : null}
                </form>
              </li>
            ))}
            {changes.length === 0 ? <li className="py-3 text-slate-500">No changes yet.</li> : null}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Loan officers who asked to hear from you ({prospects.length})</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr><th className="p-3">When</th><th className="p-3">Name</th><th className="p-3">Contact</th><th className="p-3">Area</th><th className="p-3">Plan</th><th className="p-3">Notes</th><th className="p-3">Kit</th></tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 align-top">
                    <td className="p-3 whitespace-nowrap">{when(p.updatedAt)}</td>
                    <td className="p-3">{p.name}</td>
                    <td className="p-3">{[p.email, p.phone].filter(Boolean).join(" · ")}</td>
                    <td className="p-3">{[p.city, p.state, p.zip].filter(Boolean).join(" ")}</td>
                    <td className="p-3">{p.planInterest ?? "-"}</td>
                    <td className="p-3">{p.notes ?? ""}</td>
                    <td className="p-3">{p.starterKitId ? <Link className="text-cyan-700 underline" href={`/starter-kit/${p.starterKitId}`}>Open</Link> : "-"}</td>
                  </tr>
                ))}
                {prospects.length === 0 ? <tr><td className="p-3 text-slate-500" colSpan={7}>None yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Starter kits drafted ({kits.length})</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {kits.map((kit) => (
              <li key={kit.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>{kit.officerName} · {kit.city}, {kit.state}</span>
                <span className="text-slate-500">{when(kit.createdAt)}</span>
                <Link className="text-cyan-700 underline" href={`/starter-kit/${kit.id}`}>Open</Link>
              </li>
            ))}
            {kits.length === 0 ? <li className="p-3 text-slate-500">None yet.</li> : null}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Borrower callback requests ({actions.length})</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {actions.map((action) => (
              <li key={action.id} className="p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{leadNames.get(action.borrowerLeadId) ?? "Lead"} → {officerNames.get(action.loId) ?? "House account"}</span>
                  <span className="text-slate-500">{action.status.replace("_", " ")} · {when(action.updatedAt)}</span>
                </div>
                <p className="mt-1 text-slate-700">{action.body}</p>
              </li>
            ))}
            {actions.length === 0 ? <li className="p-3 text-slate-500">None yet.</li> : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
