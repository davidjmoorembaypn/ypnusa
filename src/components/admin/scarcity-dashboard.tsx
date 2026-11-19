"use client";

import { useMemo, useRef, useState } from "react";
import { parseContacts, toCsv, type ParsedContacts } from "@/lib/csv";
import { EXPORT_COLUMNS, claimedNeighborZips, matchContacts, toExportRows, type ScarcityEventView, type ScarcityNeighbor } from "@/lib/scarcity-match";

const BTN =
  "min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label, doneLabel = "Copied" }: { text: string; label: string; doneLabel?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  return (
    <button
      type="button"
      className={BTN}
      onClick={async () => {
        setState((await copyText(text)) ? "done" : "failed");
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "done" ? doneLabel : state === "failed" ? "Copy blocked" : label}
    </button>
  );
}

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
};

export function ScarcityDashboard({ initialEvents }: { initialEvents: ScarcityEventView[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [recheckState, setRecheckState] = useState<Record<string, "busy" | "failed" | "done">>({});
  const [contacts, setContacts] = useState<ParsedContacts | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [onlyZip, setOnlyZip] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  // Claimed is a property of the ZIP code: one "claimed" re-check removes it from every alert.
  const claimedZips = useMemo(() => claimedNeighborZips(events), [events]);
  const openZips = useMemo(() => {
    const seen = new Map<string, ScarcityNeighbor>();
    for (const e of events) for (const n of e.neighbors) if (!claimedZips.has(n.zip) && !seen.has(n.zip)) seen.set(n.zip, n);
    return [...seen.values()].sort((a, b) => a.zip.localeCompare(b.zip));
  }, [events, claimedZips]);

  const matches = useMemo(() => (contacts ? matchContacts(contacts.contacts, events, onlyZip || undefined) : []), [contacts, events, onlyZip]);

  async function readFile(file: File | undefined) {
    setFileError("");
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setFileError("That file is over 10 MB. Split it and upload the parts.");
      return;
    }
    try {
      const parsed = parseContacts(await file.text());
      if (parsed.contacts.length === 0) setFileError("No contacts found. The first row must be column headers, such as First Name, Email and Office ZIP.");
      else if (!parsed.columns.zip) setFileError("No ZIP column found. Add one named zip, Office ZIP, zip_code or postal_code.");
      setContacts(parsed);
      setFileName(file.name);
    } catch {
      setFileError("Could not read that file.");
    }
  }

  async function recheck(eventId: string) {
    setRecheckState((s) => ({ ...s, [eventId]: "busy" }));
    try {
      const res = await fetch(`/api/admin/scarcity-alerts?event=${encodeURIComponent(eventId)}&recheck=1`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { events: ScarcityEventView[] };
      const fresh = data.events[0];
      setEvents((all) => all.map((e) => (e.id === eventId && fresh ? fresh : e)));
      setRecheckState((s) => ({ ...s, [eventId]: "done" }));
    } catch {
      setRecheckState((s) => ({ ...s, [eventId]: "failed" }));
    }
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="alerts-heading">
        <h2 id="alerts-heading" className="text-xl font-semibold">
          Neighbor lock alerts
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Logged when a ZIP code locks to a paying loan officer. Neighbors are the nearest open ZIP codes by distance between ZIP code centers, so some are a few
          miles away. Nothing is sent from here.
        </p>
        {events.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
            No alerts yet. One is logged each time a ZIP code locks and open ZIP codes are found nearby.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {events.map((e) => (
              <li key={e.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    ZIP {e.lockedZip}
                    {e.lockedCity ? ` · ${e.lockedCity}, ${e.lockedState}` : ""} locked
                    <span className="ml-2 text-sm font-normal text-slate-600">{formatWhen(e.createdAt)}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {recheckState[e.id] === "failed" ? <span className="text-sm text-rose-700">Re-check failed</span> : null}
                    <button type="button" className={BTN} disabled={recheckState[e.id] === "busy"} onClick={() => void recheck(e.id)}>
                      {recheckState[e.id] === "busy" ? "Checking..." : "Re-check availability"}
                    </button>
                  </div>
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {e.neighbors.map((n) => (
                    <li key={n.zip} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <p className="font-semibold">
                        {n.zip}
                        {n.city ? ` · ${n.city}, ${n.state}` : ""}
                        <span className="ml-2 font-normal text-slate-600">{n.miles} mi</span>
                        {claimedZips.has(n.zip) ? <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">now claimed</span> : null}
                        {n.status === "unknown" && !claimedZips.has(n.zip) ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">status unknown</span> : null}
                        {n.status === "open" && !claimedZips.has(n.zip) ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">still open</span> : null}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <CopyButton label="Email template" text={`Subject: ${n.outreach.email_fomo.subject}\n\n${n.outreach.email_fomo.body}`} />
                        <CopyButton label="LinkedIn template" text={n.outreach.linkedin_dm.body} />
                        <CopyButton label="Branch pitch" text={n.outreach.branch_audit_pitch.body} />
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="matcher-heading">
        <h2 id="matcher-heading" className="text-xl font-semibold">
          Match a contact list
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Drop a CSV of loan officer contacts. It is read in this browser and is not uploaded anywhere. Contacts whose ZIP code is one of the open neighbors above get
          a personalized email and LinkedIn message. Recognized columns: first name, last name, email, zip or office ZIP, NMLS ID and company.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void readFile(e.dataTransfer.files?.[0]);
          }}
          className={`mt-4 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? "border-violet-500 bg-violet-50" : "border-slate-300 bg-white"}`}
        >
          <p className="text-sm text-slate-700">Drag and drop a .csv file here, or</p>
          <input ref={fileInput} type="file" accept=".csv,text/csv" className="sr-only" id="contact-csv" onChange={(e) => void readFile(e.target.files?.[0])} />
          <label htmlFor="contact-csv" className={`${BTN} cursor-pointer`}>
            Choose a CSV
          </label>
          {fileName ? <p className="text-sm font-medium text-slate-800">{fileName}</p> : null}
        </div>
        {fileError ? (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            {fileError}
          </p>
        ) : null}

        {contacts ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-700" aria-live="polite">
              Read {contacts.contacts.length} contacts{contacts.skipped ? ` (${contacts.skipped} empty rows skipped)` : ""}.{" "}
              <span className="font-semibold">{matches.length} match an open neighbor ZIP code.</span>
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="only-zip" className="block text-sm font-semibold text-slate-700">
                  Filter by open ZIP code
                </label>
                <select id="only-zip" value={onlyZip} onChange={(e) => setOnlyZip(e.target.value)} className="mt-1 min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">All open ZIP codes ({openZips.length})</option>
                  {openZips.map((n) => (
                    <option key={n.zip} value={n.zip}>
                      {n.zip}
                      {n.city ? ` · ${n.city}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className={BTN}
                disabled={matches.length === 0}
                onClick={() => downloadCsv("matched-outreach.csv", toCsv(EXPORT_COLUMNS, toExportRows(matches)))}
              >
                Export Matched CSV ({matches.length})
              </button>
            </div>

            {matches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                No contacts match yet. Matches need a contact ZIP code that is one of the open neighbors listed above.
              </p>
            ) : (
              <ul className="space-y-3">
                {matches.map((m, i) => (
                  <li key={`${m.contact.email}-${m.targetZip}-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-semibold">
                      {[m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") || "(no name)"}
                      <span className="ml-2 text-sm font-normal text-slate-600">
                        {m.contact.company ? `${m.contact.company} · ` : ""}
                        {m.contact.email || "no email"}
                        {m.contact.nmlsId ? ` · NMLS ${m.contact.nmlsId}` : ""}
                      </span>
                    </p>
                    <p className="text-sm text-slate-600">
                      ZIP {m.targetZip}
                      {m.targetCity ? ` (${m.targetCity})` : ""} is open, near {m.lockedZip}
                      {m.lockedCity ? ` (${m.lockedCity})` : ""}, which just locked.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <CopyButton label="Copy Email" text={`Subject: ${m.emailSubject}\n\n${m.emailBody}`} />
                      <CopyButton label="Copy LinkedIn DM" text={m.linkedinBody} />
                      {m.mailto ? (
                        <a href={m.mailto} className={`${BTN} inline-flex items-center`}>
                          Open in email app
                        </a>
                      ) : (
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                          {m.contact.email ? "Too long for a mailto link: use Copy Email" : "No email address"}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Before you send: email only people you may lawfully contact, keep the postal address and opt-out line the template includes, and honor opt-outs. Messages
          describe ZIP code availability only. They quote no rates and promise no leads or loans.
        </p>
      </section>
    </div>
  );
}
