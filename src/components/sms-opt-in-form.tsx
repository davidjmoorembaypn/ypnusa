"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { BTN_PRIMARY, LINK } from "@/components/homepage/ui";
import { SMS_OPT_IN_NAME_MAX_LENGTH, validateSmsOptIn, type SmsOptInField } from "@/lib/sms-opt-in";
import { LO_SMS_CONSENT_DISCLOSURE, LO_SMS_CONSENT_STATEMENT } from "@/lib/sms-program";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

const INPUT =
  "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-500 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 aria-[invalid=true]:border-rose-600";

/**
 * The loan officer text opt-in form. The consent box always starts unticked, and nothing is
 * sent until the number is valid and the box is ticked. The server checks both again.
 */
export function SmsOptInForm() {
  const id = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SmsOptInField, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "sending") return;
    const checked = validateSmsOptIn({ name, phone, consent });
    if (!checked.ok) {
      setErrors(checked.errors);
      setStatus({ kind: "idle" });
      return;
    }
    setErrors({});
    setStatus({ kind: "sending" });
    try {
      const response = await fetch("/api/sms-opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: checked.value.name ?? "", phone: checked.value.phone, consent: true }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (response.ok && body?.ok) {
        setStatus({ kind: "done", message: body.message ?? "You're opted in to text messages from YPN USA." });
      } else {
        setStatus({ kind: "error", message: body?.error ?? "Your opt-in could not be saved. Please try again." });
      }
    } catch {
      setStatus({ kind: "error", message: "We couldn't reach YPN USA. Check your connection and try again." });
    }
  }

  if (status.kind === "done") {
    return (
      <div role="status" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
        <p className="text-lg font-semibold text-emerald-950">Thank you. Your text opt-in is confirmed.</p>
        <p className="mt-3 text-sm leading-6 text-emerald-950">{status.message}</p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Message frequency varies. Message and data rates may apply. See our{" "}
          <Link href="/privacy-policy" className={LINK}>Privacy Policy</Link> and{" "}
          <Link href="/terms-of-service" className={LINK}>Terms of Service</Link>.
        </p>
      </div>
    );
  }

  const nameId = `${id}-name`;
  const phoneId = `${id}-phone`;
  const consentId = `${id}-consent`;

  return (
    <form noValidate onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div>
        <label htmlFor={nameId} className="text-sm font-semibold text-slate-900">
          Full name or business name <span className="font-normal text-slate-600">(optional)</span>
        </label>
        <input
          id={nameId}
          name="name"
          type="text"
          autoComplete="name"
          maxLength={SMS_OPT_IN_NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${nameId}-error` : undefined}
          className={INPUT}
          placeholder="Jordan Lee or Lee Home Loans"
        />
        {errors.name ? (
          <p id={`${nameId}-error`} role="alert" className="mt-2 text-sm font-semibold text-rose-700">{errors.name}</p>
        ) : null}
      </div>

      <div className="mt-6">
        <label htmlFor={phoneId} className="text-sm font-semibold text-slate-900">
          Mobile phone number
        </label>
        <p id={`${phoneId}-help`} className="mt-1 text-sm text-slate-600">
          A 10-digit US mobile number, for example (559) 512-0372.
        </p>
        <input
          id={phoneId}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
          maxLength={20}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={`${phoneId}-help${errors.phone ? ` ${phoneId}-error` : ""}`}
          className={INPUT}
          placeholder="(555) 555-5555"
        />
        {errors.phone ? (
          <p id={`${phoneId}-error`} role="alert" className="mt-2 text-sm font-semibold text-rose-700">{errors.phone}</p>
        ) : null}
      </div>

      <fieldset className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold text-slate-900">Text message consent</legend>
        <div className="flex items-start gap-3">
          <input
            id={consentId}
            name="smsConsent"
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={`${consentId}-disclosure${errors.consent ? ` ${consentId}-error` : ""}`}
            className="mt-1 h-5 w-5 shrink-0 accent-emerald-700"
          />
          <div>
            <label htmlFor={consentId} className="text-sm leading-6 text-slate-900">
              {LO_SMS_CONSENT_STATEMENT}
            </label>
            <p id={`${consentId}-disclosure`} className="mt-2 text-sm leading-6 text-slate-700">
              {LO_SMS_CONSENT_DISCLOSURE}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              <Link href="/privacy-policy" className={LINK}>Privacy Policy</Link>
              {" · "}
              <Link href="/terms-of-service" className={LINK}>Terms of Service</Link>
            </p>
          </div>
        </div>
        {errors.consent ? (
          <p id={`${consentId}-error`} role="alert" className="mt-3 text-sm font-semibold text-rose-700">{errors.consent}</p>
        ) : null}
      </fieldset>

      {status.kind === "error" ? (
        <p role="alert" className="mt-6 text-sm font-semibold text-rose-700">{status.message}</p>
      ) : null}

      <button type="submit" disabled={status.kind === "sending"} className={`${BTN_PRIMARY} mt-6 w-full disabled:opacity-60 sm:w-auto`}>
        {status.kind === "sending" ? "Saving..." : "Opt in to text messages"}
      </button>
    </form>
  );
}
