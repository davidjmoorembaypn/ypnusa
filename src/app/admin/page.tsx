import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SessionBar } from "@/components/session-bar";
import { summarizeAdminOverview } from "@/lib/admin-overview";
import { requireAdminSession } from "@/lib/auth";
import { backupHealth } from "@/lib/backup-status";
import { readDb, storageMode } from "@/lib/db";
import { formatUsdFromCents } from "@/lib/format";
import { HOMEPAGE_HEADLINE } from "@/lib/homepage-copy";
import { liveHeadline } from "@/lib/seo";
import { LIMITS, proposeChange, revertChange } from "@/lib/site-optimizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Owner dashboard",
  robots: { index: false, follow: false },
};

function when(iso: string | null | undefined): string {
  if (!iso) return "never";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "unknown";
  return at.toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" });
}

function done(message: string): never {
  revalidatePath("/admin");
  redirect(`/admin?msg=${encodeURIComponent(message)}#edit`);
}

async function saveHeadline(formData: FormData) {
  "use server";
  await requireAdminSession("/admin");
  const value = String(formData.get("headline") ?? "");
  const result = await proposeChange({
    path: "/",
    field: "headline",
    value,
    source: "admin",
    reason: "Changed by the owner at /admin.",
    previousValue: liveHeadline("/") ?? HOMEPAGE_HEADLINE,
  });
  done(result.ok ? "Homepage headline is live. It can take a minute to show everywhere." : result.problems.join(" "));
}

async function saveSearchText(formData: FormData) {
  "use server";
  await requireAdminSession("/admin");
  const field = formData.get("field") === "description" ? "description" : "title";
  const result = await proposeChange({
    path: String(formData.get("path") ?? ""),
    field,
    value: String(formData.get("value") ?? ""),
    source: "admin",
    reason: "Changed by the owner at /admin.",
  });
  done(result.ok ? `Google ${field} for ${result.record.path} is live.` : result.problems.join(" "));
}

async function undo(formData: FormData) {
  "use server";
  await requireAdminSession("/admin");
  const id = String(formData.get("id") ?? "");
  // Only the owner's own edits are undone here; Cerebro's changes are handled on /admin/cerebro.
  const own = readDb().siteOverrides.find((item) => item.id === id && item.source === "admin" && item.status === "live");
  if (!own) done("That change isn't live any more.");
  done((await revertChange(id, "Undone by the owner at /admin.")) ? "Undone. The page shows what it showed before." : "That change isn't live any more.");
}

const card = "rounded-xl border border-slate-200 bg-white p-5";
const stat = "rounded-xl border border-slate-200 bg-white p-4";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={stat}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

const HEALTH_WORDS: Record<string, string> = { ok: "Running", stale: "Late", failing: "Failing", unknown: "Not set up" };

/** The owner's home: who signed up, who pays, which ZIP codes are taken, site health, and a few safe edits. */
export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdminSession("/admin");
  const { msg } = await searchParams;
  const db = readDb();
  const overview = summarizeAdminOverview(db);
  const storage = storageMode();
  const backup = backupHealth();
  const headlineNow = liveHeadline("/") ?? HOMEPAGE_HEADLINE;
  const ownEdits = [...db.siteOverrides].filter((item) => item.source === "admin").reverse().slice(0, 15);

  return (
    <main className="min-h-full bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-4 font-semibold">
            <Link href="/" className="text-cyan-700 hover:text-teal-600">View website</Link>
            <Link href="/admin/revenue" className="text-cyan-700 hover:text-teal-600">Revenue</Link>
            <Link href="/admin/cerebro" className="text-cyan-700 hover:text-teal-600">Cerebro activity</Link>
            <Link href="/admin/scarcity-alerts" className="text-cyan-700 hover:text-teal-600">ZIP code alerts</Link>
          </div>
          <SessionBar />
        </nav>

        <header>
          <h1 className="text-2xl font-semibold">Owner dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Only you can see this page. Updated {when(overview.generatedAt)} (Pacific).</p>
        </header>
        {msg ? <p className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm font-medium">{msg.slice(0, 300)}</p> : null}

        <section aria-label="At a glance" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Paying loan officers" value={String(overview.plans.paying)} note={`${overview.plans.trialing} on a free trial`} />
          <Stat label="Monthly revenue" value={formatUsdFromCents(overview.plans.mrrCents)} note="From paying plans" />
          <Stat label="Sign-ups" value={String(overview.signups.total)} note={`${overview.signups.last7Days} this week · ${overview.signups.last30Days} in 30 days`} />
          <Stat label="ZIP codes locked" value={String(overview.zipLocks.length)} note="Locked at first payment" />
          <Stat label="Paid in 30 days" value={formatUsdFromCents(overview.payments.last30DaysCents)} note={`${overview.payments.last30DaysCount} payment(s)`} />
          <Stat label="Text opt-ins" value={String(overview.textOptIns.optIns)} note={`${overview.textOptIns.stopReplies} STOP replies`} />
          <Stat label="Borrower leads" value={String(overview.activity.borrowerLeads)} note={`${overview.activity.borrowerLeadsLast7Days} this week`} />
          <Stat label="Demo requests" value={String(overview.activity.demoRequestsLast30Days)} note="In 30 days" />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className={card}>
            <h2 className="text-lg font-semibold">ZIP codes locked</h2>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {overview.zipLocks.map((lock) => (
                <li key={`${lock.zip}-${lock.owner}`} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-semibold">{lock.zip}</span>
                  <span className="text-slate-600">{lock.owner} · {lock.tier} · since {when(lock.since)}</span>
                </li>
              ))}
              {overview.zipLocks.length === 0 ? <li className="py-2 text-slate-500">No ZIP codes locked yet.</li> : null}
            </ul>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold">Recent payments</h2>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {overview.payments.recent.map((payment, index) => (
                <li key={`${payment.paidAt}-${index}`} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-semibold">{formatUsdFromCents(payment.amountCents)}{payment.currency && payment.currency.toLowerCase() !== "usd" ? ` ${payment.currency.toUpperCase()}` : ""}</span>
                  <span className="text-slate-600">{payment.reason} · {when(payment.paidAt)}</span>
                </li>
              ))}
              {overview.payments.recent.length === 0 ? <li className="py-2 text-slate-500">No card payments recorded yet.</li> : null}
            </ul>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold">Newest sign-ups</h2>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {overview.recentSignups.map((signup) => (
                <li key={signup.email} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-medium break-all">{signup.email}</span>
                  <span className="text-slate-600">{signup.source} · {when(signup.createdAt)}</span>
                </li>
              ))}
              {overview.recentSignups.length === 0 ? <li className="py-2 text-slate-500">No sign-ups yet.</li> : null}
            </ul>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold">Site health</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Data saving</dt>
              <dd>{storage.unavailable || storage.error ? "Problem: check with Claude" : storage.persistent ? "OK" : "Not saving to disk"}</dd>
              <dt className="text-slate-500">Hourly backup</dt>
              <dd>{HEALTH_WORDS[backup.status] ?? backup.status}{backup.lastSuccessAt ? ` · last ${when(backup.lastSuccessAt)}` : ""}</dd>
              <dt className="text-slate-500">Off-server copy</dt>
              <dd>{backup.offHost === "ok" ? "Running" : backup.offHost === "failed" ? "Failing" : "Off"}</dd>
              <dt className="text-slate-500">Outgoing email</dt>
              <dd>{process.env.RESEND_API_KEY?.trim() ? "On" : "Off"}</dd>
              <dt className="text-slate-500">Site version</dt>
              <dd>{process.env.APP_COMMIT ? process.env.APP_COMMIT.slice(0, 7) : "unknown"}{process.env.APP_BUILT_AT ? ` · built ${when(process.env.APP_BUILT_AT)}` : ""}</dd>
            </dl>
          </section>
        </div>

        <section id="edit" className={card}>
          <h2 className="text-lg font-semibold">Make a change</h2>
          <p className="mt-1 text-sm text-slate-600">
            Changes go live at once and keep what they replaced, so you can undo each one below. The site&rsquo;s mortgage
            advertising checks still apply: no rates, guarantees or &ldquo;#1&rdquo; claims.
          </p>

          <form action={saveHeadline} className="mt-5 flex flex-col gap-2 text-sm">
            <label htmlFor="headline" className="font-semibold">Homepage headline</label>
            <p className="text-slate-500">
              The big black sentence at the top of ypnus.com. The purple Cerebro line after it stays the same.
            </p>
            <input
              id="headline"
              name="headline"
              defaultValue={headlineNow}
              minLength={LIMITS.headline.min}
              maxLength={LIMITS.headline.max}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 font-semibold text-white">Save headline</button>
              <span className="text-slate-500">{LIMITS.headline.min} to {LIMITS.headline.max} characters.</span>
            </div>
          </form>

          <form action={saveSearchText} className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-5 text-sm">
            <span className="font-semibold">Google search text for any page</span>
            <p className="text-slate-500">
              The title and short description people see for a page in Google. Page is the part after ypnus.com, like / or /pricing.
            </p>
            <div className="grid gap-2 sm:grid-cols-[12rem_10rem_1fr]">
              <input name="path" placeholder="/pricing" required aria-label="Page" className="rounded-lg border border-slate-300 px-3 py-2" />
              <select name="field" aria-label="Which text" className="rounded-lg border border-slate-300 px-3 py-2">
                <option value="title">Title ({LIMITS.title.min}-{LIMITS.title.max})</option>
                <option value="description">Description ({LIMITS.description.min}-{LIMITS.description.max})</option>
              </select>
              <input name="value" required maxLength={LIMITS.description.max} aria-label="New text" placeholder="New text" className="rounded-lg border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 font-semibold text-white">Save search text</button>
            </div>
          </form>

          <h3 className="mt-6 border-t border-slate-100 pt-5 text-sm font-semibold">Your recent changes</h3>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {ownEdits.map((change) => (
              <li key={change.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{change.path} · {change.field === "headline" ? "headline" : `Google ${change.field}`}</span>
                  <span className="text-slate-500">{change.status === "live" ? "Live" : change.status === "reverted" ? "Undone" : change.status} · {when(change.appliedAt ?? change.createdAt)}</span>
                </div>
                <p className="mt-1">{change.value}</p>
                {change.previousValue ? <p className="text-slate-500">Before: {change.previousValue}</p> : null}
                {change.status === "live" ? (
                  <form action={undo} className="mt-2">
                    <input type="hidden" name="id" value={change.id} />
                    <button type="submit" className="rounded-full border border-slate-300 px-3 py-1">Undo</button>
                  </form>
                ) : null}
              </li>
            ))}
            {ownEdits.length === 0 ? <li className="py-3 text-slate-500">No changes yet.</li> : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
