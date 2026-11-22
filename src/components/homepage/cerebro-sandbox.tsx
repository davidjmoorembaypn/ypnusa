"use client";

import { useId, useRef, useState } from "react";
import { track } from "@/lib/track";
import { MobileCollapse } from "./mobile-collapse";

interface Scenario {
  id: string;
  tab: string;
  program: string;
  /** Borrower and Cerebro turns, in order. */
  chat: ReadonlyArray<{ from: "borrower" | "cerebro"; text: string }>;
  summary: ReadonlyArray<[string, string]>;
  sms: string;
  email: { subject: string; body: string };
}

/**
 * Three illustrative conversations. Cerebro explains programs in general terms and gathers the
 * borrower's goal, timeline, price range and consent; it never quotes or locks a rate, never
 * says who qualifies, and always hands off to the licensed loan officer.
 */
const SCENARIOS: readonly Scenario[] = [
  {
    id: "fha",
    tab: "FHA First-Time Buyer (9:42 PM)",
    program: "FHA",
    chat: [
      { from: "borrower", text: "We've never bought a home and don't have much saved. Is there any way we can buy this year?" },
      {
        from: "cerebro",
        text: "Many first-time buyers look at FHA loans, which are designed for smaller down payments. Your loan officer will confirm what fits you. Can I ask a few quick questions so they're ready when they call?",
      },
      { from: "borrower", text: "Sure. We're looking around $380,000 in Visalia and want to move by summer." },
      {
        from: "cerebro",
        text: "Got it: about $380,000, Visalia, moving by summer. What's the best number, and is it OK for your loan officer to call or text you tomorrow morning?",
      },
      { from: "borrower", text: "Yes, text is best. (559) 555-0142." },
    ],
    summary: [
      ["Goal", "First home purchase"],
      ["Program interest", "FHA"],
      ["Price range", "About $380,000"],
      ["Area", "Visalia, CA"],
      ["Timeline", "By summer"],
      ["Contact", "Text preferred, consent given 9:47 PM"],
    ],
    sms: "Hi Maria, this is [Your Name], your local loan officer. Thanks for chatting last night about buying your first home in Visalia. I have a few minutes today to walk through your options. Is 12:15 or 5:30 better?",
    email: {
      subject: "Your first-home questions, and a time to talk",
      body: "Hi Maria,\n\nThanks for reaching out last night. I read through your conversation: a first home around $380,000 in Visalia, moving by summer.\n\nI'd like to walk you through how FHA and other options work and what to gather first. Would a 15-minute call today or tomorrow work?\n\n[Your Name]\nNMLS #[Your NMLS]",
    },
  },
  {
    id: "va",
    tab: "VA Zero-Down Inquiry",
    program: "VA",
    chat: [
      { from: "borrower", text: "I served six years in the Army. Somebody told me I can buy with nothing down. Is that true?" },
      {
        from: "cerebro",
        text: "Thank you for your service. VA loans are a benefit for eligible veterans and service members, and many are made with no down payment. Your loan officer will check your eligibility and entitlement. May I get a few details for them?",
      },
      { from: "borrower", text: "OK. I'm renting in Clovis now, lease is up in about 90 days. Thinking $450,000 or so." },
      {
        from: "cerebro",
        text: "Thanks: Clovis, about $450,000, lease ending in roughly 90 days. Do you have your Certificate of Eligibility yet? It's fine if not. And how should your loan officer reach you?",
      },
      { from: "borrower", text: "Not yet. Email me: sample.veteran@example.com. Calls after 4 are fine too." },
    ],
    summary: [
      ["Goal", "Purchase, currently renting"],
      ["Program interest", "VA"],
      ["Price range", "About $450,000"],
      ["Area", "Clovis, CA"],
      ["Timeline", "About 90 days (lease ending)"],
      ["Contact", "Email first, calls after 4 PM, consent given"],
    ],
    sms: "Hi James, this is [Your Name], your local loan officer. Thank you for your service. I saw your note about buying in Clovis in the next 90 days. I can help you request your Certificate of Eligibility. OK if I call after 4 today?",
    email: {
      subject: "Your VA home loan benefit: next steps",
      body: "Hi James,\n\nThank you for your service, and for reaching out. I read your conversation: buying in Clovis around $450,000, with your lease ending in about 90 days.\n\nThe first step is your Certificate of Eligibility, and I can help you request it. From there we'll go through your options together.\n\nI'll call after 4 PM today unless another time is better.\n\n[Your Name]\nNMLS #[Your NMLS]",
    },
  },
  {
    id: "dscr",
    tab: "DSCR Real Estate Investor",
    program: "DSCR",
    chat: [
      { from: "borrower", text: "I own two rentals and I'm self-employed. My tax returns make it hard to qualify. Any options for a third property?" },
      {
        from: "cerebro",
        text: "Some investors use DSCR loans, where the lender looks mainly at the property's rental income compared with its payment. Your loan officer will tell you what's available to you. What kind of property are you looking at?",
      },
      { from: "borrower", text: "A duplex in Fresno, around $520,000. Rents should be about $3,900 a month total. I'd put 25% down." },
      {
        from: "cerebro",
        text: "Noted: Fresno duplex, about $520,000, estimated rent $3,900 a month, 25% down. When are you hoping to make an offer, and what's the best way for your loan officer to reach you?",
      },
      { from: "borrower", text: "Next 30 days. Call me at (559) 555-0167, mornings." },
    ],
    summary: [
      ["Goal", "Investment purchase (third rental)"],
      ["Program interest", "DSCR"],
      ["Property", "Duplex, about $520,000, Fresno, CA"],
      ["Borrower stated", "Rent about $3,900/mo, 25% down, self-employed"],
      ["Timeline", "Offer within 30 days"],
      ["Contact", "Phone, mornings, consent given"],
    ],
    sms: "Hi Alex, this is [Your Name], your local loan officer. I saw your note about the Fresno duplex. I work with investors on DSCR and other options. Can I call you tomorrow at 9:00 AM?",
    email: {
      subject: "Financing options for your Fresno duplex",
      body: "Hi Alex,\n\nThanks for the details on the duplex: about $520,000, estimated rent of $3,900 a month and 25% down.\n\nI'd like to go over how DSCR financing works and what a lender will want to see for the property. I'll call tomorrow morning; reply here if another time suits you better.\n\n[Your Name]\nNMLS #[Your NMLS]",
    },
  },
];

type Draft = "sms" | "email";

function ChatTurns({ turns }: { turns: Scenario["chat"] }) {
  return (
    <ol className="mt-3 flex flex-col gap-3">
      {turns.map((turn, i) => (
        <li
          key={i}
          className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            turn.from === "borrower"
              ? "self-end rounded-br-md bg-slate-900 text-white"
              : "self-start rounded-bl-md border border-slate-200 bg-slate-50 text-slate-900"
          }`}
        >
          <span className={`block text-[11px] font-semibold uppercase tracking-wide ${turn.from === "borrower" ? "text-slate-200" : "text-violet-800"}`}>
            {turn.from === "borrower" ? "Borrower" : "Cerebro"}
          </span>
          {turn.text}
        </li>
      ))}
    </ol>
  );
}

/**
 * "Live Cerebro" sandbox: three tabs, each showing a borrower conversation on the left and what
 * the loan officer receives on the right (lead summary plus a follow-up draft awaiting approval).
 * A scripted illustration, clearly labelled: nothing here calls the model or stores anything.
 */
export function CerebroSandbox() {
  const baseId = useId();
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState<Draft>("sms");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const draftPanelId = `${baseId}-draft`;

  function select(index: number, focus = false) {
    const next = (index + SCENARIOS.length) % SCENARIOS.length;
    setActive(next);
    track("cerebro_sandbox_tab", { scenario: SCENARIOS[next].id });
    if (focus) tabRefs.current[next]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select(index + 1, true);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select(index - 1, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0, true);
    } else if (event.key === "End") {
      event.preventDefault();
      select(SCENARIOS.length - 1, true);
    }
  }

  return (
    <div>
      <div role="tablist" aria-label="Cerebro demo scenarios" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        {SCENARIOS.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`min-h-[48px] rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                selected ? "border-violet-800 bg-violet-800 text-white" : "border-slate-400 bg-white text-slate-900 hover:bg-slate-100"
              }`}
            >
              {item.tab}
            </button>
          );
        })}
      </div>

      {SCENARIOS.map((item, index) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={index !== active}
          tabIndex={0}
          className="mt-6 rounded-3xl"
        >
          {index === active ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Borrower conversation */}
              <section aria-label="Borrower conversation" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-semibold text-slate-900">On your page: borrower chat</h3>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900">{item.program}</span>
                </div>
                <ChatTurns turns={item.chat.slice(0, 2)} />
                <MobileCollapse label={`Show the rest of the conversation (${item.chat.length - 2} more)`} name={`sandbox_chat_${item.id}`} className="mt-3">
                  <ChatTurns turns={item.chat.slice(2)} />
                </MobileCollapse>
              </section>

              {/* What the loan officer receives */}
              <section aria-label="Handoff to you, the loan officer" className="rounded-3xl border border-emerald-300 bg-white p-4 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-semibold text-slate-900">In your dashboard: instant handoff</h3>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">New lead</span>
                </div>
                <dl className="mt-4 grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                  {item.summary.map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="font-medium text-slate-600">{label}</dt>
                      <dd className="break-words font-semibold text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Follow-up draft</p>
                    <div role="group" aria-label="Draft type" className="inline-flex rounded-full border border-slate-400 bg-white p-0.5">
                      {(["sms", "email"] as const).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          aria-pressed={draft === kind}
                          aria-controls={draftPanelId}
                          onClick={() => {
                            if (draft !== kind) track("cerebro_sandbox_draft", { scenario: item.id, draft: kind });
                            setDraft(kind);
                          }}
                          className={`min-h-[36px] rounded-full px-4 text-xs font-semibold transition ${
                            draft === kind ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-slate-100"
                          }`}
                        >
                          {kind === "sms" ? "SMS" : "Email"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div id={draftPanelId} className="mt-3 text-sm leading-relaxed text-slate-900">
                    {draft === "sms" ? (
                      <p>{item.sms}</p>
                    ) : (
                      <>
                        <p className="font-semibold">Subject: {item.email.subject}</p>
                        <p className="mt-2 whitespace-pre-line">{item.email.body}</p>
                      </>
                    )}
                  </div>
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
                    <span aria-hidden className="h-2 w-2 rounded-full bg-amber-600" />
                    {draft === "sms"
                      ? "Texts always wait for you: Cerebro drafts, you send."
                      : "Sent by Cerebro to opted-in borrowers after its compliance checks, or held for your OK in approve-first mode."}
                  </p>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      ))}

      <p className="mt-4 text-center text-xs text-slate-600">
        Illustration with made-up borrowers, not a real conversation and not a promise of leads or loans. Cerebro never quotes or locks
        rates and never makes credit decisions; every borrower is handed to you, the licensed loan officer.
      </p>
    </div>
  );
}
