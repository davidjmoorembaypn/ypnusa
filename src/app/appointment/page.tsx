import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cancelAppointment, formatWhen, isActive, officerForAppointment, officerTimeZone, verifyManageToken } from "@/lib/appointments";
import { readDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your appointment | YPN USA",
  robots: { index: false, follow: false },
};

async function cancel(formData: FormData) {
  "use server";
  const id = String(formData.get("a") ?? "");
  const token = String(formData.get("t") ?? "");
  if (!verifyManageToken(id, token)) redirect("/appointment?done=bad");
  const result = await cancelAppointment(id, "borrower");
  redirect(`/appointment?done=${result.ok ? "cancelled" : result.error}`);
}

type Props = { searchParams: Promise<{ a?: string; t?: string; done?: string }> };

export default async function AppointmentPage({ searchParams }: Props) {
  const { a, t, done } = await searchParams;
  const valid = Boolean(a && t && verifyManageToken(a, t));
  const appointment = valid ? readDb().appointments.find((item) => item.id === a) : undefined;
  const officer = appointment ? officerForAppointment(appointment.loId) : undefined;
  const when = appointment && officer ? formatWhen(appointment.start, appointment.timeZone ?? officerTimeZone(officer)) : "";

  let body: React.ReactNode;
  if (done === "cancelled") {
    body = (
      <p className="text-white/85">
        Your appointment is cancelled. To pick a new time, chat with Cerebro on the{" "}
        <Link className="text-cyan-300 underline" href="/">home page</Link> or reply to your confirmation email.
      </p>
    );
  } else if (done) {
    body = <p className="text-white/85">That didn&rsquo;t work: the appointment may already be cancelled or over. Reply to your confirmation email and the loan officer will help.</p>;
  } else if (!appointment || !officer) {
    body = <p className="text-white/85">Use the link in your confirmation email to manage your appointment.</p>;
  } else if (!isActive(appointment)) {
    body = <p className="text-white/85">This appointment was cancelled. Chat with Cerebro on the <Link className="text-cyan-300 underline" href="/">home page</Link> to pick a new time.</p>;
  } else {
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-white/85">
          You&rsquo;re booked with <strong>{officer.name}</strong> on <strong>{when}</strong>.
        </p>
        {appointment.meetingUrl ? (
          <p className="text-white/85">
            Join at that time: <a className="text-cyan-300 underline" href={appointment.meetingUrl}>{appointment.meetingUrl}</a>
          </p>
        ) : null}
        <p className="text-white/70">Need another time? Cancel here, then chat with Cerebro to pick a new one.</p>
        <form action={cancel}>
          <input type="hidden" name="a" value={appointment.id} />
          <input type="hidden" name="t" value={t} />
          <button type="submit" className="rounded-full bg-cyan-500 px-6 py-3 font-semibold text-[#09081b]">Cancel this appointment</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-5 py-16">
          <h1 className="text-3xl font-semibold">Your appointment</h1>
          {body}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
