"use client";

import type { Ref } from "react";
import { isCompleteZip, sanitizeZip } from "@/lib/zip-session";

/**
 * The one ZIP code field used across the site: numeric keypad, five digits at most, and anything
 * that isn't a digit is dropped as it is typed or pasted ("93618-1234" and " 93618 " both become
 * 93618). Works controlled (pass `value`) or uncontrolled inside a plain GET form.
 */
export function ZipInput({
  value,
  onValueChange,
  onEnter,
  inputRef,
  className,
  placeholder = "5-digit ZIP code",
  id,
  name,
  required,
  invalid,
  describedBy,
  ariaLabel,
}: {
  value?: string;
  onValueChange?: (zip: string) => void;
  onEnter?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
}) {
  function apply(input: HTMLInputElement, raw: string) {
    const clean = sanitizeZip(raw);
    if (input.value !== clean) input.value = clean;
    onValueChange?.(clean);
  }

  return (
    <input
      id={id}
      ref={inputRef}
      name={name}
      type="text"
      inputMode="numeric"
      pattern="[0-9]{5}"
      maxLength={5}
      autoComplete="postal-code"
      enterKeyHint="go"
      data-zip-input=""
      required={required}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      placeholder={placeholder}
      value={value}
      onChange={(event) => apply(event.currentTarget, event.currentTarget.value)}
      onPaste={(event) => {
        // maxLength would cut " 93618" to " 9361" before the digits are picked out, so paste by hand.
        event.preventDefault();
        apply(event.currentTarget, event.clipboardData.getData("text"));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && onEnter) {
          event.preventDefault();
          onEnter();
        }
      }}
      className={className}
    />
  );
}

/**
 * Inline feedback under a ZIP code field: how many digits are left, then a clear "ready" at five.
 * Only the "ready" change is announced to screen readers, so typing isn't narrated digit by digit.
 */
export function ZipHint({ zip, id, error, idleText }: { zip: string; id?: string; error?: string | null; idleText?: string }) {
  const complete = isCompleteZip(zip);
  const remaining = 5 - zip.length;
  return (
    <p id={id} className="mt-2 min-h-[1.25rem] text-[13px] leading-5">
      {error ? (
        <span role="alert" className="font-semibold text-rose-700">
          {error}
        </span>
      ) : complete ? (
        <span className="font-semibold text-emerald-800">
          <span aria-hidden>✓ </span>5 digits. Ready to check.
        </span>
      ) : zip.length > 0 ? (
        <span className="text-slate-700">
          Enter {remaining} more digit{remaining === 1 ? "" : "s"}.
        </span>
      ) : (
        <span className="text-slate-600">{idleText ?? "Numbers only, 5 digits."}</span>
      )}
      <span role="status" className="sr-only">
        {complete && !error ? "ZIP code complete. Ready to check." : ""}
      </span>
    </p>
  );
}
