import type { Metadata } from "next";
import Link from "next/link";
import { SessionBar } from "@/components/session-bar";
import { requireAdminSession } from "@/lib/auth";
import { readDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cerebro activity | YPN USA admin",
  robots: { index: false, follow: false },
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" });
}

/** What Cerebro did on its own: loan officers who asked to hear from YPN USA, starter kits, borrower callbacks. */
export default async function AdminCerebroPage() {
  await requireAdminSession("/admin/cerebro");
  const db = readDb();
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
