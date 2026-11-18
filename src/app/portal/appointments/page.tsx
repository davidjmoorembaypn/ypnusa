import Link from "next/link";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SessionBar } from "@/components/session-bar";
import { canManageAppointment, cancelAppointment, listUpcoming } from "@/lib/appointments";
import { requireSession } from "@/lib/auth";
import { disconnectGoogle, googleOAuthConfigured, officerForViewer } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Appointments",
  robots: { index: false, follow: false },
};

function done(message: string): never {
  revalidatePath("/portal/appointments");
  redirect(`/portal/appointments?msg=${encodeURIComponent(message)}`);
}

async function cancel(formData: FormData) {
  "use server";
  const session = await requireSession("/portal/appointments");
  const id = String(formData.get("id") ?? "");
  if (!canManageAppointment(id, session)) done("That appointment isn't yours to cancel.");
  const result = await cancelAppointment(id, session.role === "admin" ? "admin" : "officer");
  done(result.ok ? "Cancelled. The borrower was emailed a way to rebook." : "It was already cancelled or is in the past.");
}

async function disconnect() {
  "use server";
  const session = await requireSession("/portal/appointments");
  const officer = officerForViewer(session);
  if (officer) disconnectGoogle(officer.id);
  done("Google Calendar disconnected. Cerebro books from your set hours again.");
}

type Props = { searchParams: Promise<{ msg?: string }> };

export default async function AppointmentsPage({ searchParams }: Props) {
  const session = await requireSession("/portal/appointments");
  const { msg } = await searchParams;
  const officer = officerForViewer(session);
  const appointments = listUpcoming(session);
  const connected = Boolean(officer?.googleRefreshToken);

  return (
    <main className="min-h-screen bg-[#09081b] px-4 py-8 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Appointments</p>
            <h1 className="text-3xl font-semibold tracking-tight">Booked by Cerebro</h1>
            <p className="max-w-2xl text-sm leading-6 text-white/60">
              Borrowers pick a time in chat. They get a confirmation, a reminder the day before and a link to cancel or
              change it. You get each booking by email with a calendar invite.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="w-fit rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">
              Dashboard
            </Link>
            <SessionBar tone="dark" />
          </div>
        </header>

        {msg ? <p className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-sm">{msg.slice(0, 300)}</p> : null}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Google Calendar</h2>
          {connected ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/75">
              <span>Connected. Cerebro only offers times you&rsquo;re free and puts each booking on your calendar.</span>
              <form action={disconnect}>
                <button type="submit" className="rounded-full border border-white/20 px-4 py-2 font-semibold">Disconnect</button>
              </form>
            </div>
          ) : googleOAuthConfigured() ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/75">
              <span>Connect it so Cerebro books around your real schedule.</span>
              <a href="/api/calendar/google/connect" className="rounded-full bg-cyan-500 px-4 py-2 font-semibold text-[#09081b]">Connect Google Calendar</a>
            </div>
          ) : (
            <p className="mt-2 text-sm text-white/60">
              Calendar connection is coming soon. Until then Cerebro books within your set hours, and each booking arrives as
              a calendar invite you can add to any calendar.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Upcoming ({appointments.length})</h2>
          {appointments.length === 0 ? (
            <p className="mt-2 text-sm text-white/60">Nothing booked yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {appointments.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm">
                    <p className="font-semibold">{item.borrower} · {item.when}</p>
                    <p className="text-white/60">
                      {[item.email, item.phone].filter(Boolean).join(" · ")}
                      {session.role === "admin" ? ` · with ${item.officer}` : ""}
                    </p>
                    {item.notes ? <p className="text-white/60">Notes: {item.notes}</p> : null}
                    {item.meetingUrl ? (
                      <a className="text-cyan-300 underline" href={item.meetingUrl}>Meeting link</a>
                    ) : null}
                  </div>
                  <form action={cancel}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="rounded-full border border-rose-300/40 px-4 py-2 text-sm font-semibold text-rose-200">Cancel</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
