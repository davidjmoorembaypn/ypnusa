import { canContact } from "@/lib/consent";
import { borrowerFacingOfficer, HOUSE_OFFICER_ID, houseOfficerRecord } from "@/lib/crm";
import { readDb, writeDb } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import { signValue, verifySignedValue } from "@/lib/session";
import { MARKETING_SITE_URL } from "@/lib/site";
import type { AppointmentRecord, BorrowerLeadRecord, LoanOfficerRecord } from "@/lib/types";

/**
 * What happens around a booked appointment, after calendar.ts has found the slot and booked it:
 * - Confirmation email to the borrower, with a calendar invite (.ics) and a link to cancel or
 *   pick another time, and a notice to the officer with the same invite. An .ics invite lands in
 *   Google, Outlook or Apple calendars, so this works before an officer connects a calendar.
 * - A reminder email the day before (within the borrower's email consent and opt-out).
 * - Cancelling, by the borrower (signed link) or the officer (dashboard or Cerebro chat): both
 *   sides get a cancellation and the invite is withdrawn.
 *
 * These are transactional emails about a meeting the borrower asked for: no rates, no loan
 * terms, just the time, the officer and the link.
 */

export const DEFAULT_TIME_ZONE = "America/Los_Angeles";

export function isActive(appointment: AppointmentRecord): boolean {
  return appointment.status !== "cancelled";
}

export function officerForAppointment(loId: string): LoanOfficerRecord {
  const found = readDb().loanOfficers.find((officer) => officer.id === loId);
  if (!found) return houseOfficerRecord();
  return borrowerFacingOfficer(loId === HOUSE_OFFICER_ID ? { ...houseOfficerRecord(), ...found } : found);
}

export function officerTimeZone(officer: Pick<LoanOfficerRecord, "calendarTimeZone">): string {
  const zone = officer.calendarTimeZone?.trim();
  if (!zone || zone === "UTC") return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** "Thursday, November 20 at 10:30 AM PST" */
export function formatWhen(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);
  return `${day} at ${time}`;
}

// ---------------------------------------------------------------- links

export function manageToken(appointmentId: string): string {
  return signValue(`appt:${appointmentId}`);
}

export function verifyManageToken(appointmentId: string, token: string): boolean {
  return Boolean(appointmentId && token) && verifySignedValue(`appt:${appointmentId}`, token);
}

export function manageUrl(appointmentId: string): string {
  const params = new URLSearchParams({ a: appointmentId, t: manageToken(appointmentId) });
  return `${MARKETING_SITE_URL}/appointment?${params.toString()}`;
}

// ---------------------------------------------------------------- calendar invite

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

function icsTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** One VEVENT as an iTIP request (or cancel), so mail apps offer "add to calendar". */
export function buildIcs(appointment: AppointmentRecord, officer: LoanOfficerRecord, lead: BorrowerLeadRecord, cancel = false): string {
  const borrower = lead.answers.name?.trim() || "Borrower";
  const description = [
    `Mortgage consultation between ${officer.name} and ${borrower}.`,
    appointment.meetingUrl ? `Join: ${appointment.meetingUrl}` : null,
    `Cancel or pick another time: ${manageUrl(appointment.id)}`,
    "Booked by Cerebro, the AI assistant for YPN USA loan officers.",
  ]
    .filter(Boolean)
    .join("\n");
  const attendees = [
    lead.answers.email ? `ATTENDEE;CN=${icsText(borrower)};ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:${lead.answers.email}` : null,
    `ATTENDEE;CN=${icsText(officer.name)};ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:${officer.email}`,
  ].filter(Boolean);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YPN USA//Cerebro//EN",
    `METHOD:${cancel ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${appointment.id}@ypnus.com`,
    `SEQUENCE:${cancel ? 1 : 0}`,
    `DTSTAMP:${icsTime(new Date().toISOString())}`,
    `DTSTART:${icsTime(appointment.start)}`,
    `DTEND:${icsTime(appointment.end)}`,
    `SUMMARY:${icsText(`Mortgage consultation: ${officer.name} and ${borrower}`)}`,
    `DESCRIPTION:${icsText(description)}`,
    ...(appointment.meetingUrl ? [`LOCATION:${icsText(appointment.meetingUrl)}`] : []),
    "ORGANIZER;CN=YPN USA:mailto:support@ypnus.com",
    ...attendees,
    `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

// ---------------------------------------------------------------- emails

function wrap(inner: string): string {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#13254a">${inner}</div>`;
}

function disclosureLine(officer: LoanOfficerRecord): string {
  return [officer.name, officer.company, officer.nmlsId ? `NMLS #${officer.nmlsId}` : null, officer.equalHousing === "lender" ? "Equal Housing Lender" : "Equal Housing Opportunity"]
    .filter(Boolean)
    .map((part) => escapeHtml(String(part)))
    .join(" | ");
}

/** May we email this borrower about their appointment? Their opt-out always wins. */
function mayEmail(lead: BorrowerLeadRecord, now: Date): boolean {
  if (!lead.answers.email?.trim()) return false;
  const db = readDb();
  const decision = canContact({ db, borrowerLeadId: lead.id, channel: "email", legacyConsent: lead.answers.contactConsent === true, now });
  return decision.allowed;
}

function update(id: string, patch: Partial<AppointmentRecord>): AppointmentRecord | undefined {
  let saved: AppointmentRecord | undefined;
  writeDb((db) => {
    const record = db.appointments.find((item) => item.id === id);
    if (!record) return;
    Object.assign(record, patch);
    saved = { ...record };
  });
  return saved;
}

function find(id: string): { appointment: AppointmentRecord; lead?: BorrowerLeadRecord } | undefined {
  const db = readDb();
  const appointment = db.appointments.find((item) => item.id === id);
  if (!appointment) return undefined;
  return { appointment, lead: db.borrowerLeads.find((item) => item.id === appointment.borrowerLeadId) };
}

type Send = typeof sendEmail;

/** True when Google or Outlook created the event, so their own invites go out and we attach none. */
function onProviderCalendar(appointment: AppointmentRecord): boolean {
  return (appointment.provider === "google" || appointment.provider === "microsoft") && Boolean(appointment.externalEventId);
}

const MAX_CONFIRMATION_ATTEMPTS = 6;

/**
 * Confirmation to the borrower and a notice to the officer, each with the invite. Each side is
 * recorded only once its email actually went out (or it can't be emailed: no address, opted
 * out), so a failed send is retried by retryPendingConfirmations. Returns true when both are done.
 * Never throws.
 */
export async function sendBookingConfirmation(appointmentId: string, now = new Date(), send: Send = sendEmail): Promise<boolean> {
  try {
    const found = find(appointmentId);
    if (!found?.lead) return false;
    if (found.appointment.confirmationSentAt) return true;
    const { appointment, lead } = found;
    const officer = officerForAppointment(appointment.loId);
    const zone = appointment.timeZone ?? officerTimeZone(officer);
    const when = formatWhen(appointment.start, zone);
    const onProvider = onProviderCalendar(appointment);
    const invite = onProvider
      ? undefined
      : [{ filename: "invite.ics", content: buildIcs(appointment, officer, lead), contentType: "text/calendar" }];
    const join = appointment.meetingUrl ? `<p>Join here at that time: <a href="${escapeHtml(appointment.meetingUrl)}">${escapeHtml(appointment.meetingUrl)}</a></p>` : "";
    const first = escapeHtml(lead.answers.name?.split(/\s+/)[0] || "there");
    const stamp = now.toISOString();
    const patch: Partial<AppointmentRecord> = { confirmationAttempts: (appointment.confirmationAttempts ?? 0) + 1 };

    let borrowerDone = Boolean(appointment.borrowerConfirmedAt);
    if (!borrowerDone) {
      if (!mayEmail(lead, now)) {
        borrowerDone = true; // nothing we may send them
      } else {
        const result = await send({
          to: lead.answers.email!.trim(),
          subject: `Booked: your call with ${officer.name}, ${when}`,
          replyTo: officer.email,
          fromName: `${officer.name} via YPN USA`,
          attachments: invite,
          html: wrap(
            `<p>Hi ${first},</p><p>You're booked with ${escapeHtml(officer.name)} on <strong>${escapeHtml(when)}</strong> for about 30 minutes.</p>${join}<p>${onProvider ? "A calendar invite is on its way separately." : "The calendar invite is attached."} Need a different time? <a href="${escapeHtml(manageUrl(appointment.id))}">Cancel or pick another time</a>.</p><p style="font-size:12px;color:#666">Booked by Cerebro, the AI assistant for ${escapeHtml(officer.name)}. Reply to this email to reach them.<br>${disclosureLine(officer)}</p>`,
          ),
        });
        borrowerDone = result.sent;
        if (!result.sent) console.error(`[appointments] borrower confirmation for ${appointment.id} failed: ${result.reason ?? "unknown"}`);
      }
      if (borrowerDone) patch.borrowerConfirmedAt = stamp;
    }

    let officerDone = Boolean(appointment.officerNotifiedAt);
    if (!officerDone) {
      const result = await send({
        to: officer.email,
        subject: `New appointment: ${lead.answers.name ?? "a borrower"}, ${when}`,
        fromName: "Cerebro at YPN USA",
        attachments: invite,
        html: wrap(
          `<p>Cerebro booked ${escapeHtml(lead.answers.name ?? "a borrower")} with you on <strong>${escapeHtml(when)}</strong>.</p>${join}<p>${lead.answers.email ? `Email: ${escapeHtml(lead.answers.email)}<br>` : ""}${lead.answers.phone ? `Phone: ${escapeHtml(lead.answers.phone)}<br>` : ""}${appointment.borrowerNotes ? `Notes: ${escapeHtml(appointment.borrowerNotes)}` : ""}</p><p>${onProvider ? "It's on your calendar." : "The invite is attached."} To cancel, ask Cerebro or open your appointments in the dashboard.</p>`,
        ),
      });
      officerDone = result.sent;
      if (result.sent) patch.officerNotifiedAt = stamp;
      else console.error(`[appointments] officer notice for ${appointment.id} failed: ${result.reason ?? "unknown"}`);
    }

    if (borrowerDone && officerDone) patch.confirmationSentAt = stamp;
    update(appointment.id, patch);
    return borrowerDone && officerDone;
  } catch (error) {
    console.error("[appointments] confirmation failed", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Retries confirmations that didn't fully go out: booked, still upcoming, older than two minutes
 * (so it never races the first send) and under the attempt limit. Returns how many finished.
 */
export async function retryPendingConfirmations(now = new Date(), send: Send = sendEmail): Promise<number> {
  const due = readDb().appointments.filter(
    (item) =>
      isActive(item) &&
      !item.confirmationSentAt &&
      (item.confirmationAttempts ?? 0) < MAX_CONFIRMATION_ATTEMPTS &&
      Date.parse(item.start) > now.getTime() &&
      Date.parse(item.createdAt) < now.getTime() - 2 * 60_000,
  );
  let finished = 0;
  for (const item of due) if (await sendBookingConfirmation(item.id, now, send)) finished++;
  return finished;
}

/** Takes cancelled events off the officer's calendar when the first try failed. Returns how many cleared. */
export async function retryProviderCleanup(now = new Date()): Promise<number> {
  const pending = readDb().appointments.filter(
    (item) =>
      item.status === "cancelled" &&
      item.providerCleanup === "pending" &&
      (item.providerCleanupAttempts ?? 0) < 10 &&
      Date.parse(item.end) > now.getTime() - 86400_000,
  );
  let cleared = 0;
  for (const item of pending) if (await removeFromProviderCalendar(item)) cleared++;
  return cleared;
}

async function removeFromProviderCalendar(appointment: AppointmentRecord): Promise<boolean> {
  try {
    const { cancelProviderEvent } = await import("@/lib/calendar");
    await cancelProviderEvent(appointment);
    update(appointment.id, { providerCleanup: "done" });
    return true;
  } catch (error) {
    console.error(`[appointments] calendar cancel for ${appointment.id} failed`, error instanceof Error ? error.message : error);
    update(appointment.id, { providerCleanupAttempts: (appointment.providerCleanupAttempts ?? 0) + 1 });
    return false;
  }
}

/** Reminders for appointments starting in the next 18 to 30 hours. Returns how many went out. */
export async function sendDueReminders(now = new Date(), send: Send = sendEmail): Promise<number> {
  const from = now.getTime() + 18 * 3600_000;
  const to = now.getTime() + 30 * 3600_000;
  const db = readDb();
  let sent = 0;
  for (const appointment of db.appointments) {
    const start = Date.parse(appointment.start);
    if (!isActive(appointment) || appointment.reminderSentAt || start < from || start > to) continue;
    const lead = db.borrowerLeads.find((item) => item.id === appointment.borrowerLeadId);
    if (!lead || !mayEmail(lead, now)) {
      update(appointment.id, { reminderSentAt: now.toISOString() }); // don't retry a borrower we may not email
      continue;
    }
    const officer = officerForAppointment(appointment.loId);
    const when = formatWhen(appointment.start, appointment.timeZone ?? officerTimeZone(officer));
    const join = appointment.meetingUrl ? `<p>Join here: <a href="${escapeHtml(appointment.meetingUrl)}">${escapeHtml(appointment.meetingUrl)}</a></p>` : "";
    const result = await send({
      to: lead.answers.email!.trim(),
      subject: `Reminder: your call with ${officer.name}, ${when}`,
      replyTo: officer.email,
      fromName: `${officer.name} via YPN USA`,
      html: wrap(
        `<p>Hi ${escapeHtml(lead.answers.name?.split(/\s+/)[0] || "there")},</p><p>A reminder that you're meeting ${escapeHtml(officer.name)} on <strong>${escapeHtml(when)}</strong>.</p>${join}<p>Can't make it? <a href="${escapeHtml(manageUrl(appointment.id))}">Cancel or pick another time</a>.</p><p style="font-size:12px;color:#666">Sent by Cerebro, the AI assistant for ${escapeHtml(officer.name)}.<br>${disclosureLine(officer)}</p>`,
      ),
    });
    if (result.sent) {
      update(appointment.id, { reminderSentAt: now.toISOString() });
      sent++;
    }
  }
  return sent;
}

export type CancelResult = { ok: true; appointment: AppointmentRecord } | { ok: false; error: "not_found" | "already_cancelled" | "in_the_past" };

/** Cancels, withdraws the invite and tells the other side. */
export async function cancelAppointment(
  appointmentId: string,
  by: "borrower" | "officer" | "admin",
  now = new Date(),
  send: Send = sendEmail,
): Promise<CancelResult> {
  const found = find(appointmentId);
  if (!found) return { ok: false, error: "not_found" };
  if (!isActive(found.appointment)) return { ok: false, error: "already_cancelled" };
  if (Date.parse(found.appointment.start) < now.getTime()) return { ok: false, error: "in_the_past" };
  const onProvider = onProviderCalendar(found.appointment);
  const appointment = update(appointmentId, {
    status: "cancelled",
    cancelledAt: now.toISOString(),
    cancelledBy: by,
    ...(onProvider ? { providerCleanup: "pending" as const } : {}),
  })!;
  // A failure here stays "pending" and is retried by retryProviderCleanup.
  if (onProvider) await removeFromProviderCalendar(appointment);
  const lead = found.lead;
  const officer = officerForAppointment(appointment.loId);
  const when = formatWhen(appointment.start, appointment.timeZone ?? officerTimeZone(officer));
  try {
    const invite = lead && !onProvider ? [{ filename: "cancel.ics", content: buildIcs(appointment, officer, lead, true), contentType: "text/calendar" }] : undefined;
    if (lead && mayEmail(lead, now)) {
      await send({
        to: lead.answers.email!.trim(),
        subject: `Cancelled: your call with ${officer.name}, ${when}`,
        replyTo: officer.email,
        fromName: `${officer.name} via YPN USA`,
        attachments: invite,
        html: wrap(
          `<p>Your call with ${escapeHtml(officer.name)} on ${escapeHtml(when)} is cancelled${by === "borrower" ? " as you asked" : ""}.</p><p>To pick a new time, <a href="${escapeHtml(MARKETING_SITE_URL)}">chat with Cerebro on ypnus.com</a> or reply to this email.</p><p style="font-size:12px;color:#666">${disclosureLine(officer)}</p>`,
        ),
      });
    }
    await send({
      to: officer.email,
      subject: `Cancelled: ${lead?.answers.name ?? "a borrower"}, ${when}`,
      fromName: "Cerebro at YPN USA",
      attachments: invite,
      html: wrap(`<p>${escapeHtml(lead?.answers.name ?? "A borrower")}'s appointment on ${escapeHtml(when)} was cancelled by ${by === "borrower" ? "the borrower" : "you"}.</p>`),
    });
  } catch (error) {
    console.error("[appointments] cancel emails failed", error instanceof Error ? error.message : error);
  }
  return { ok: true, appointment };
}

/** The officer's upcoming appointments (an admin sees all), soonest first. */
export function listUpcoming(viewer: { sub: string; role: string }, now = new Date()) {
  const db = readDb();
  return db.appointments
    .filter((appointment) => isActive(appointment) && Date.parse(appointment.end) >= now.getTime())
    .filter((appointment) => viewer.role === "admin" || appointment.loId === viewer.sub)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .map((appointment) => {
      const lead = db.borrowerLeads.find((item) => item.id === appointment.borrowerLeadId);
      const officer = officerForAppointment(appointment.loId);
      return {
        id: appointment.id,
        when: formatWhen(appointment.start, appointment.timeZone ?? officerTimeZone(officer)),
        start: appointment.start,
        borrower: lead?.answers.name ?? "Borrower",
        email: lead?.answers.email,
        phone: lead?.answers.phone,
        officer: officer.name,
        meetingUrl: appointment.meetingUrl,
        notes: appointment.borrowerNotes,
      };
    });
}

export function canManageAppointment(appointmentId: string, viewer: { sub: string; role: string }): boolean {
  const appointment = readDb().appointments.find((item) => item.id === appointmentId);
  if (!appointment) return false;
  return viewer.role === "admin" || appointment.loId === viewer.sub;
}
