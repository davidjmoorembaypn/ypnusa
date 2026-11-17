"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";
import { LEAD_MESSAGE_MAX_LENGTH } from "@/lib/lead-sources";
import { WP_FORMS, wpFormPayload, type WpFormSpec } from "@/lib/wp-forms";

function fieldValue(form: HTMLFormElement, name: string | undefined): string {
  if (!name) return "";
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : "";
}

function checked(form: HTMLFormElement, name: string | undefined): boolean {
  if (!name) return false;
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement && el.checked;
}

/** The form's own status line (".res"), or one added under the submit button. */
function statusLine(form: HTMLFormElement): HTMLElement {
  const existing = form.querySelector<HTMLElement>(".res, [data-wp-form-status]");
  if (existing) return existing;
  const line = document.createElement("p");
  line.setAttribute("data-wp-form-status", "");
  line.setAttribute("role", "status");
  line.setAttribute("aria-live", "polite");
  line.style.marginTop = "0.75rem";
  line.style.fontWeight = "600";
  form.appendChild(line);
  return line;
}

function attach(spec: WpFormSpec): (() => void) | null {
  const form = document.getElementById(spec.formId);
  if (!(form instanceof HTMLFormElement)) return null;
  form.setAttribute("method", "post");
  form.setAttribute("action", "#");
  if (spec.fields.message) {
    const box = form.elements.namedItem(spec.fields.message);
    // The endpoint stores at most this many characters; a browser limit stops the visitor typing more.
    if (box instanceof HTMLTextAreaElement && box.maxLength < 0) box.maxLength = LEAD_MESSAGE_MAX_LENGTH;
  }

  const onSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const status = statusLine(form);
    const check = wpFormPayload(spec, {
      name: fieldValue(form, spec.fields.name),
      email: fieldValue(form, spec.fields.email),
      message: spec.fields.message ? fieldValue(form, spec.fields.message) : undefined,
      phone: fieldValue(form, spec.fields.phone),
      smsConsent: checked(form, spec.fields.smsConsent),
      checkboxTicked: checked(form, spec.requiredCheckbox),
      honeypot: fieldValue(form, spec.fields.honeypot),
    });
    if (!check.ok) {
      if (check.spam) {
        form.reset();
        status.textContent = spec.successText;
      } else {
        status.textContent = check.error;
      }
      return;
    }

    const button = form.querySelector<HTMLButtonElement>("button[type=submit], button:not([type])");
    if (button) button.disabled = true;
    status.textContent = "Sending…";
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.payload),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "That didn't go through. Please try again, or email support@ypnus.com.");
      form.reset();
      track("generate_lead", { method: spec.source });
      const panel = spec.successId ? document.getElementById(spec.successId) : null;
      if (panel) {
        status.textContent = "";
        form.style.display = "none";
        panel.style.display = "block";
        panel.setAttribute("role", "status");
        panel.focus?.();
      } else {
        status.textContent = spec.successText;
      }
    } catch (error) {
      status.textContent =
        error instanceof Error && error.message
          ? error.message
          : "That didn't go through. Please try again, or email support@ypnus.com.";
    } finally {
      if (button) button.disabled = false;
    }
  };

  form.addEventListener("submit", onSubmit, { capture: true });
  return () => form.removeEventListener("submit", onSubmit, { capture: true });
}

/** Wires the lead forms inside imported WordPress pages to this app (see src/lib/wp-forms.ts). */
export function WpFormBridge() {
  useEffect(() => {
    const detach = WP_FORMS.map(attach).filter((fn): fn is () => void => fn !== null);
    return () => detach.forEach((fn) => fn());
  }, []);
  return null;
}
