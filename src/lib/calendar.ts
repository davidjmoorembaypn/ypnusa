import { DEFAULT_TIME_ZONE, sendBookingConfirmation } from "./appointments";
import { ensureHouseOfficer, HOUSE_OFFICER_ID } from "./crm";
import { appendAppointment, cancelPendingFollowUps, readDb } from "./db";
import { googleAccessToken, googleOAuthConfigured } from "./google-calendar";
import { requestProviderJson } from "./outbound";
import { generateId } from "./id";
import type {
  AppointmentRecord,
  BorrowerLeadRecord,
  CalendarProvider,
  LoanOfficerRecord,
} from "./types";

const SLOT_DURATION_MIN = 30;

export interface CalendarSlotProposal {
  start: string;
  end: string;
  loId: string;
  provider: CalendarProvider;
  source: "live" | "local";
  externalBookingUrl?: string;
}

interface CalendarConnection {
  provider: CalendarProvider;
  /** Set for Google: the officer's own access token (connected through OAuth) or the server-wide one. */
  token?: string;
  calendarId?: string;
  timeZone: string;
  calendlyUrl?: string;
}

interface BusyWindow {
  start: number;
  end: number;
}

interface ProviderEvent {
  externalEventId?: string;
  meetingUrl?: string;
  externalBookingUrl?: string;
}

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Returns the next weekday dates (excluding today unless weekend bridge needed) */
export function collectBusinessAnchors(limit: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  let safety = 0;
  while (days.length < limit && safety < 180) {
    safety += 1;
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      days.push(utcDay(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function configuredConnection(officer: LoanOfficerRecord): CalendarConnection {
  let override:
    | {
        provider?: CalendarProvider;
        calendarId?: string;
        timeZone?: string;
        calendlyUrl?: string;
      }
    | undefined;

  const raw = process.env.MLO_CALENDAR_CONFIG_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, typeof override>;
      override = parsed[officer.id];
    } catch {
      console.error("[calendar] MLO_CALENDAR_CONFIG_JSON is not valid JSON");
    }
  }

  return {
    provider: override?.provider ?? officer.calendarProvider ?? "local",
    calendarId: override?.calendarId ?? officer.calendarId,
    timeZone: override?.timeZone ?? officer.calendarTimeZone ?? "UTC",
    calendlyUrl: override?.calendlyUrl ?? officer.calendlyUrl,
  };
}

export function calendarConnectionStatus(officer: LoanOfficerRecord): CalendarConnection & {
  connected: boolean;
} {
  const connection = configuredConnection(officer);
  let connected = connection.provider === "local";
  switch (connection.provider) {
    case "local":
      connected = true;
      break;
    case "google":
      connected =
        Boolean(officer.googleRefreshToken && googleOAuthConfigured()) ||
        Boolean(process.env.GOOGLE_CALENDAR_ACCESS_TOKEN && connection.calendarId);
      break;
    case "microsoft":
      connected = Boolean(process.env.MICROSOFT_GRAPH_ACCESS_TOKEN && connection.calendarId);
      break;
    case "calendly":
      connected = Boolean(connection.calendlyUrl);
      break;
    default:
      connection.provider satisfies never;
  }
  return { ...connection, connected };
}

function utcDateFromMinutes(day: Date, minutes: number): Date {
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, minutes, 0, 0),
  );
}

export function listAvailableSlots(loId?: string, horizonDays = 8): CalendarSlotProposal[] {
  const db = readDb();
  const roster = loId
    ? db.loanOfficers.filter((officer) => officer.id === loId)
    : db.loanOfficers;

  const occupancy = db.appointments.filter((appointment) => appointment.status !== "cancelled").map((appointment) => ({
    officer: appointment.loId,
    start: new Date(appointment.start).getTime(),
    end: new Date(appointment.end).getTime(),
  }));

  const proposals: CalendarSlotProposal[] = [];

  roster.forEach((officer) => {
    collectBusinessAnchors(horizonDays).forEach((anchor) => {
      const dow = anchor.getUTCDay();
      officer.weeklyWindows
        .filter((window) => window.dow === dow)
        .forEach((window) => {
          let minuteCursor = window.startMin;
          while (minuteCursor + SLOT_DURATION_MIN <= window.endMin) {
            const start = utcDateFromMinutes(anchor, minuteCursor);
            const end = utcDateFromMinutes(anchor, minuteCursor + SLOT_DURATION_MIN);
            const startTs = start.getTime();

            if (startTs < Date.now() - 5_000) {
              minuteCursor += SLOT_DURATION_MIN;
              continue;
            }

            const blocked = occupancy.some(
              (block) =>
                block.officer === officer.id &&
                startTs >= block.start - 1_500 &&
                startTs < block.end,
            );

            if (!blocked) {
              proposals.push({
                loId: officer.id,
                start: start.toISOString(),
                end: end.toISOString(),
                provider: configuredConnection(officer).provider,
                source: "local",
                externalBookingUrl: configuredConnection(officer).calendlyUrl,
              });
            }

            minuteCursor += SLOT_DURATION_MIN;
          }
        });
    });
  });

  proposals.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  /** Keep UI payloads lean */
  return proposals.slice(0, 96);
}

async function fetchGoogleBusy(
  connection: CalendarConnection,
  start: string,
  end: string,
): Promise<BusyWindow[]> {
  const token = connection.token;
  if (!token || !connection.calendarId) throw new Error("Google Calendar is not connected.");
  const payload = await requestProviderJson<{
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
  }>({
    url: "https://www.googleapis.com/calendar/v3/freeBusy",
    token,
    failureLabel: "Google Calendar availability",
    method: "POST",
    body: {
      timeMin: start,
      timeMax: end,
      timeZone: connection.timeZone,
      items: [{ id: connection.calendarId }],
    },
  });
  return (payload.calendars?.[connection.calendarId]?.busy ?? []).map((window) => ({
    start: Date.parse(window.start),
    end: Date.parse(window.end),
  }));
}

async function fetchMicrosoftBusy(
  connection: CalendarConnection,
  start: string,
  end: string,
): Promise<BusyWindow[]> {
  const token = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN?.trim();
  if (!token || !connection.calendarId) throw new Error("Microsoft Calendar is not connected.");
  const params = new URLSearchParams({ startDateTime: start, endDateTime: end, $select: "start,end" });
  const payload = await requestProviderJson<{
    value?: Array<{ start?: { dateTime?: string }; end?: { dateTime?: string } }>;
  }>({
    url: `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(connection.calendarId)}/calendarView?${params}`,
    token,
    failureLabel: "Microsoft Calendar availability",
    headers: { Prefer: 'outlook.timezone="UTC"' },
  });
  return (payload.value ?? [])
    .map((event) => ({
      start: Date.parse(`${event.start?.dateTime ?? ""}Z`),
      end: Date.parse(`${event.end?.dateTime ?? ""}Z`),
    }))
    .filter((window) => Number.isFinite(window.start) && Number.isFinite(window.end));
}

async function providerBusy(
  connection: CalendarConnection,
  start: string,
  end: string,
): Promise<{ windows: BusyWindow[]; live: boolean }> {
  switch (connection.provider) {
    case "google":
      return { windows: await fetchGoogleBusy(connection, start, end), live: true };
    case "microsoft":
      return { windows: await fetchMicrosoftBusy(connection, start, end), live: true };
    case "local":
    case "calendly":
      return { windows: [], live: false };
    default:
      return connection.provider satisfies never;
  }
}

/** The officer's connection, with a live Google token when they connected Google Calendar. */
export async function resolvedConnection(officer: LoanOfficerRecord): Promise<CalendarConnection> {
  const connection = configuredConnection(officer);
  if (connection.provider !== "google") return connection;
  // An officer who connected their own Google account only ever uses their own token: falling
  // back to the server-wide token would book borrowers onto someone else's "primary" calendar.
  const token = officer.googleRefreshToken
    ? await googleAccessToken(officer)
    : process.env.GOOGLE_CALENDAR_ACCESS_TOKEN?.trim();
  // No usable token: fall back to set hours instead of failing every booking.
  if (!token || !connection.calendarId) return { ...connection, provider: "local" };
  return { ...connection, token };
}

export async function listSyncedAvailableSlots(
  loId?: string,
  horizonDays = 8,
): Promise<CalendarSlotProposal[]> {
  const db = readDb();
  const officers = loId
    ? db.loanOfficers.filter((officer) => officer.id === loId)
    : db.loanOfficers;
  const candidates = listAvailableSlots(loId, horizonDays);
  const enriched: CalendarSlotProposal[] = [];

  for (const officer of officers) {
    const officerSlots = candidates.filter((slot) => slot.loId === officer.id);
    if (officerSlots.length === 0) continue;
    const connection = await resolvedConnection(officer);
    const start = officerSlots[0].start;
    const end = officerSlots[officerSlots.length - 1].end;

    try {
      const busy = await providerBusy(connection, start, end);
      enriched.push(
        ...officerSlots
          .filter((slot) => {
            const slotStart = Date.parse(slot.start);
            const slotEnd = Date.parse(slot.end);
            return !busy.windows.some(
              (window) => slotStart < window.end && slotEnd > window.start,
            );
          })
          .map((slot) => ({
            ...slot,
            provider: connection.provider,
            source: busy.live ? ("live" as const) : ("local" as const),
            externalBookingUrl: connection.calendlyUrl,
          })),
      );
    } catch (error) {
      console.error(`[calendar] live availability failed for ${officer.id}`, error);
      enriched.push(
        ...officerSlots.map((slot) => ({
          ...slot,
          provider: connection.provider,
          source: "local" as const,
          externalBookingUrl: connection.calendlyUrl,
        })),
      );
    }
  }

  enriched.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return enriched.slice(0, 96);
}

async function createGoogleEvent(
  connection: CalendarConnection,
  officer: LoanOfficerRecord,
  lead: BorrowerLeadRecord,
  start: Date,
  end: Date,
  notes?: string,
): Promise<ProviderEvent> {
  const token = connection.token;
  if (!token || !connection.calendarId) throw new Error("Google Calendar is not connected.");
  const payload = await requestProviderJson<{
    id?: string;
    hangoutLink?: string;
    htmlLink?: string;
  }>({
    url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    token,
    failureLabel: "Google Calendar booking",
    method: "POST",
    body: {
      summary: `Mortgage consultation: ${officer.name} and ${lead.answers.name ?? "YPN USA borrower"}`,
      description: [notes, "Booked by Cerebro, the AI assistant for YPN USA loan officers."].filter(Boolean).join("\n\n"),
      start: { dateTime: start.toISOString(), timeZone: connection.timeZone },
      end: { dateTime: end.toISOString(), timeZone: connection.timeZone },
      attendees: [{ email: lead.answers.email }],
      conferenceData: {
        createRequest: {
          requestId: generateId("meet"),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });
  return {
    externalEventId: payload.id,
    meetingUrl: payload.hangoutLink,
    externalBookingUrl: payload.htmlLink,
  };
}

async function createMicrosoftEvent(
  connection: CalendarConnection,
  officer: LoanOfficerRecord,
  lead: BorrowerLeadRecord,
  start: Date,
  end: Date,
  notes?: string,
): Promise<ProviderEvent> {
  const token = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN?.trim();
  if (!token || !connection.calendarId) throw new Error("Microsoft Calendar is not connected.");
  const payload = await requestProviderJson<{
    id?: string;
    webLink?: string;
    onlineMeeting?: { joinUrl?: string };
  }>({
    url: `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(connection.calendarId)}/events`,
    token,
    failureLabel: "Microsoft Calendar booking",
    method: "POST",
    body: {
      subject: `Mortgage consultation with ${lead.answers.name ?? "YPN USA borrower"}`,
      body: { contentType: "text", content: notes ?? "Booked by YPN USA." },
      start: { dateTime: start.toISOString(), timeZone: "UTC" },
      end: { dateTime: end.toISOString(), timeZone: "UTC" },
      attendees: [
        {
          emailAddress: { address: lead.answers.email, name: lead.answers.name },
          type: "required",
        },
        {
          emailAddress: { address: officer.email, name: officer.name },
          type: "required",
        },
      ],
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
    },
  });
  return {
    externalEventId: payload.id,
    meetingUrl: payload.onlineMeeting?.joinUrl,
    externalBookingUrl: payload.webLink,
  };
}

async function createProviderEvent(
  connection: CalendarConnection,
  officer: LoanOfficerRecord,
  lead: BorrowerLeadRecord,
  start: Date,
  end: Date,
  notes?: string,
): Promise<ProviderEvent> {
  switch (connection.provider) {
    case "google":
      return createGoogleEvent(connection, officer, lead, start, end, notes);
    case "microsoft":
      return createMicrosoftEvent(connection, officer, lead, start, end, notes);
    case "calendly":
      if (!connection.calendlyUrl) throw new Error("Calendly booking URL is not configured.");
      return { externalBookingUrl: connection.calendlyUrl };
    case "local":
      return { meetingUrl: `https://meet.jit.si/${generateId("ypn")}` };
    default:
      return connection.provider satisfies never;
  }
}

export async function bookAppointment(input: {
  borrowerLeadId: string;
  loId: string;
  startIso: string;
  notes?: string;
  /** Moving an existing booking: allowed past the one-booking check; the caller cancels the old one after. */
  replacing?: string;
}): Promise<AppointmentRecord> {
  if (input.loId === HOUSE_OFFICER_ID) ensureHouseOfficer();
  const db = readDb();
  const officer = db.loanOfficers.find((item) => item.id === input.loId);
  const lead = db.borrowerLeads.find((item) => item.id === input.borrowerLeadId);
  if (!officer || !lead) throw new Error("Borrower or assigned MLO was not found.");
  const alreadyBooked = db.appointments.find(
    (item) => item.borrowerLeadId === lead.id && item.status !== "cancelled" && Date.parse(item.start) > Date.now(),
  );
  if (alreadyBooked && alreadyBooked.id !== input.replacing) throw new Error(`This borrower already has an appointment at ${alreadyBooked.start}. Cancel it first to pick another time.`);

  const start = new Date(input.startIso);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) {
    throw new Error("Appointment start must be a future ISO date.");
  }
  const durationMs = SLOT_DURATION_MIN * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  const available = await listSyncedAvailableSlots(input.loId, 30);
  if (!available.some((slot) => slot.start === start.toISOString())) {
    throw new Error("That appointment time is no longer available.");
  }

  const connection = await resolvedConnection(officer);
  const providerEvent = await createProviderEvent(
    connection,
    officer,
    lead,
    start,
    end,
    input.notes,
  );

  const record: AppointmentRecord = {
    id: generateId("appt"),
    borrowerLeadId: input.borrowerLeadId,
    loId: input.loId,
    start: start.toISOString(),
    end: end.toISOString(),
    createdAt: new Date().toISOString(),
    borrowerNotes: input.notes,
    provider: connection.provider,
    externalEventId: providerEvent.externalEventId,
    meetingUrl: providerEvent.meetingUrl,
    externalBookingUrl: providerEvent.externalBookingUrl,
    status: "booked",
    timeZone: officer.calendarTimeZone && officer.calendarTimeZone !== "UTC" ? officer.calendarTimeZone : DEFAULT_TIME_ZONE,
  };

  appendAppointment(record);
  // The borrower has a call booked, so the "would you like to book a call?" follow-ups that
  // are still queued for them must not go out.
  cancelPendingFollowUps(input.borrowerLeadId, "Cancelled: the borrower booked a call.");
  // Emails go out in the background so the chat answers right away.
  void sendBookingConfirmation(record.id);
  return record;
}

/** Removes the booked event from the officer's calendar, when it is on one. Never throws for "already gone". */
export async function cancelProviderEvent(appointment: AppointmentRecord): Promise<void> {
  if (!appointment.externalEventId || (appointment.provider !== "google" && appointment.provider !== "microsoft")) return;
  const officer = readDb().loanOfficers.find((item) => item.id === appointment.loId);
  if (!officer) return;
  if (appointment.provider === "microsoft") {
    const connection = configuredConnection(officer);
    const token = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN?.trim();
    if (!token || !connection.calendarId) throw new Error("Microsoft Calendar is not connected, so the event couldn't be removed yet.");
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(appointment.externalEventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      throw new Error(`Microsoft Calendar cancel failed (${response.status}).`);
    }
    return;
  }
  const connection = await resolvedConnection(officer);
  // No token right now (expired sign-in, Google down): throw so the cleanup stays pending and is retried.
  if (connection.provider !== "google" || !connection.token || !connection.calendarId) {
    throw new Error("Google Calendar isn't reachable for this officer right now.");
  }
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(appointment.externalEventId)}?sendUpdates=all`,
    { method: "DELETE", headers: { Authorization: `Bearer ${connection.token}` }, signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Google Calendar cancel failed (${response.status}).`);
  }
}
